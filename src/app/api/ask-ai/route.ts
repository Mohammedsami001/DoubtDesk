import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/configs/db';
import { buildErrorResponse } from "@/lib/error-handler";
import { generateAISolution } from "@/services/ai-solver.service";

export async function POST(req: Request) {
    try {
        const user = await currentUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const fullName =
            user.fullName ||
            (user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}`
                : 'Academic Student');

        const email = user.primaryEmailAddress?.emailAddress;

        if (!email) {
            return NextResponse.json({ error: 'Email required' }, { status: 400 });
        }

        const {
            prompt,
            type = 'standard',
            imageBase64,
            classroomId,
            history = [],
        } = await req.json();

        const result = await generateAISolution(db, {
            email,
            fullName,
            prompt,
            type,
            imageBase64,
            classroomId,
            history
        });

        return NextResponse.json(result);
    } catch (error: any) {
        // Log explicitly since AI solver can throw different types of errors
        console.error('Error in Ask AI Route:', error);
        
        const { status, body } = buildErrorResponse(error);
        
        // Ensure code is passed to client if ServiceError threw it
        if (error.code) {
            body.code = error.code;
        }

        return NextResponse.json(body, { status });
    }
}
