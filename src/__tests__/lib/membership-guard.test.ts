import { currentUser } from "@clerk/nextjs/server";

import { db } from "@/configs/db";
import { ApiError } from "@/lib/error-handler";
import {
    parseClassroomId,
    parseOptionalClassroomId,
    requireAuth,
    requireMembership,
    requireTeacher,
} from "@/lib/auth/membership-guard";

jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

const membershipResults: Array<{ role: string }[]> = [];

const createMembershipQuery = () => {
    const query = {
        from: jest.fn(() => query),
        where: jest.fn(() => query),
        then: (resolve: (value: { role: string }[]) => unknown) =>
            Promise.resolve(resolve(membershipResults.shift() ?? [])),
    };
    return query;
};

jest.mock("@/configs/db", () => ({
    db: {
        select: jest.fn(),
    },
}));

const currentUserMock = currentUser as jest.MockedFunction<typeof currentUser>;
const selectMock = db.select as jest.Mock;

describe("membership guard", () => {
    beforeEach(() => {
        currentUserMock.mockReset();
        selectMock.mockReset();
        selectMock.mockImplementation(() => createMembershipQuery());
        membershipResults.length = 0;
    });

    it("returns the authenticated Clerk user and primary email", async () => {
        const user = {
            primaryEmailAddress: { emailAddress: "student@example.com" },
        };
        currentUserMock.mockResolvedValue(user as never);

        await expect(requireAuth()).resolves.toEqual({
            user,
            email: "student@example.com",
        });
    });

    it("rejects unauthenticated requests with a 401 ApiError", async () => {
        currentUserMock.mockResolvedValue(null);

        await expect(requireAuth()).rejects.toMatchObject<ApiError>({
            statusCode: 401,
            message: "Unauthorized",
        });
    });

    it("strictly parses positive classroom IDs", () => {
        expect(parseClassroomId("42")).toBe(42);
        expect(parseOptionalClassroomId(null)).toBeNull();
        expect(() => parseClassroomId("42abc")).toThrow("Invalid classroom ID");
        expect(() => parseClassroomId("1e2")).toThrow("Invalid classroom ID");
        expect(() => parseClassroomId(0)).toThrow("Invalid classroom ID");
    });

    it("returns the classroom membership role", async () => {
        membershipResults.push([{ role: "student" }]);

        await expect(
            requireMembership("student@example.com", 7),
        ).resolves.toEqual({ role: "student" });
    });

    it("rejects users without classroom membership", async () => {
        membershipResults.push([]);

        await expect(
            requireMembership("outsider@example.com", 7),
        ).rejects.toMatchObject<ApiError>({
            statusCode: 403,
            message: "Access denied to this classroom",
        });
    });

    it("requires a teacher or owner role for teacher-only actions", async () => {
        membershipResults.push([{ role: "student" }], [{ role: "teacher" }]);

        await expect(
            requireTeacher("student@example.com", 7),
        ).rejects.toMatchObject<ApiError>({ statusCode: 403 });
        await expect(
            requireTeacher("teacher@example.com", 7),
        ).resolves.toEqual({ role: "teacher" });
    });
});
