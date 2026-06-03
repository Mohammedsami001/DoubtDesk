import { NextResponse } from 'next/server';
import { db } from '@/configs/db';
import { currentUser } from '@clerk/nextjs/server';
import { buildErrorResponse } from "@/lib/error-handler";
import { getDashboardAnalytics } from "@/services/analytics.service";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const classroomIdStr = searchParams.get("classroomId");
        const classroomId = classroomIdStr ? parseInt(classroomIdStr, 10) : null;

        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const email = user.primaryEmailAddress?.emailAddress;
        if (!email) {
            return NextResponse.json({ error: "Email target missing" }, { status: 400 });
        }

        const analytics = await getDashboardAnalytics(db, {
            email,
            classroomId
        });

        return NextResponse.json(analytics);
    } catch (error) {
        const { status, body } = buildErrorResponse(error);
        return NextResponse.json(body, { status });
    }
}
