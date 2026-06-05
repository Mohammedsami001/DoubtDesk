import { NextResponse } from "next/server";
import { db } from "@/configs/db";
import { buildErrorResponse } from "@/lib/error-handler";
import { parseAndValidateRequest } from "@/lib/validations/validate";
import { createDoubtSchema } from "@/lib/validations/doubt";
import { getDoubts, createDoubt } from "@/services/doubt.service";
import { currentUser } from "@clerk/nextjs/server";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const subject = searchParams.get("subject");
    const search = searchParams.get("search");
    const userName = searchParams.get("userName");
    const classroomIdStr = searchParams.get("classroomId");
    const type = searchParams.get("type") || "community";
    const tag = searchParams.get("tag");
    const sort = searchParams.get("sort") || "newest";
    const bookmarked = searchParams.get("bookmarked") === "true";
    const pageStr = searchParams.get("page");
    const limitStr = searchParams.get("limit");
    const page = pageStr ? parseInt(pageStr, 10) : 1;
    const limit = limitStr ? parseInt(limitStr, 10) : 20;

    try {
        const user = await currentUser();
        const email = user?.primaryEmailAddress?.emailAddress ?? null;
        const classroomId = classroomIdStr ? parseInt(classroomIdStr) : null;

        const doubts = await getDoubts(db, {
            email,
            subject,
            search,
            userName,
            classroomId,
            type,
            tag,
            sort,
            bookmarked,
            page,
            limit
        });

        return NextResponse.json(doubts);
    } catch (error) {
        const { status, body } = buildErrorResponse(error);
        return NextResponse.json(body, { status });
    }
}

export async function POST(req: Request) {
    try {
        const { errorResponse, data } = await parseAndValidateRequest(req, createDoubtSchema);
        if (errorResponse) return errorResponse;
        
        const user = await currentUser();
        const email = user?.primaryEmailAddress?.emailAddress;

        if (!email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const parsedClassroomId = data.classroomId ? parseInt(data.classroomId.toString(), 10) : null;

        const newDoubt = await createDoubt(db, {
            email,
            userName: data.userName,
            subject: data.subject,
            content: data.content,
            imageUrl: data.imageUrl,
            classroomId: parsedClassroomId,
            type: data.type,
            tags: data.tags
        });

        return NextResponse.json(newDoubt);
    } catch (error) {
        const { status, body } = buildErrorResponse(error);
        return NextResponse.json(body, { status });
    }
}
