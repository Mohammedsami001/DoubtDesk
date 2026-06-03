import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/configs/db";
import { membershipsTable } from "@/configs/schema";
import { eq, and } from "drizzle-orm";
import { buildErrorResponse } from "@/lib/error-handler";
import { parseAndValidateRequest } from "@/lib/validations/validate";
import { createDoubtSchema } from "@/lib/validations/doubt";
import { getDoubts, createDoubt } from "@/services/doubt.service";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const subject = searchParams.get("subject");
    const search = searchParams.get("search");
    const userName = searchParams.get("userName");
    const classroomIdStr = searchParams.get("classroomId");
    const classroomId = classroomIdStr ? parseInt(classroomIdStr, 10) : null;
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
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const email = user.primaryEmailAddress?.emailAddress;
        if (!email) return NextResponse.json({ error: "Email target missing" }, { status: 400 });

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
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const email = user.primaryEmailAddress?.emailAddress;
        if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

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

