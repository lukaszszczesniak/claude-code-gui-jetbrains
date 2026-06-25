import {ToolUseBlockDto, ContentBlockType} from "@/dto";
import type {LoadedMessageDto} from "@/types";

export function makeToolUse(input: Record<string, unknown>, name: string): ToolUseBlockDto {
    return Object.assign(new ToolUseBlockDto(), {
        type: ContentBlockType.ToolUse,
        id: 'tool_1',
        name,
        input,
    });
}

export function makeToolResult(content: string): LoadedMessageDto {
    return {
        message: {
            content: [{type: ContentBlockType.ToolResult, content}],
        },
    } as unknown as LoadedMessageDto;
}
