import { currentUser } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/configs/db";
import { membershipsTable } from "@/configs/schema";
import { ApiError } from "@/lib/error-handler";

const TEACHER_ROLES = new Set(["teacher", "owner"]);

export type AuthenticatedUser = NonNullable<
    Awaited<ReturnType<typeof currentUser>>
>;

export type ClassroomMembership = {
    role: string;
};

export async function requireAuth(): Promise<{
    user: AuthenticatedUser;
    email: string;
}> {
    const user = await currentUser();

    if (!user) {
        throw new ApiError(401, "Unauthorized");
    }

    const email = user.primaryEmailAddress?.emailAddress;
    if (!email) {
        throw new ApiError(400, "Email required");
    }

    return { user, email };
}

export function parseClassroomId(value: unknown): number {
    const classroomId = typeof value === "number"
        ? value
        : typeof value === "string" && /^[1-9]\d*$/.test(value)
          ? Number(value)
          : Number.NaN;

    if (!Number.isSafeInteger(classroomId) || classroomId <= 0) {
        throw new ApiError(400, "Invalid classroom ID");
    }

    return classroomId;
}

export function parseOptionalClassroomId(value: unknown): number | null {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    return parseClassroomId(value);
}

export async function requireMembership(
    email: string,
    classroomId: number,
): Promise<ClassroomMembership> {
    const [membership] = await db
        .select({ role: membershipsTable.role })
        .from(membershipsTable)
        .where(
            and(
                eq(membershipsTable.userEmail, email),
                eq(membershipsTable.classroomId, classroomId),
            ),
        );

    if (!membership) {
        throw new ApiError(403, "Access denied to this classroom");
    }

    return membership;
}

export async function requireTeacher(
    email: string,
    classroomId: number,
): Promise<ClassroomMembership> {
    const membership = await requireMembership(email, classroomId);

    if (!TEACHER_ROLES.has(membership.role)) {
        throw new ApiError(403, "Forbidden: teacher access required");
    }

    return membership;
}
