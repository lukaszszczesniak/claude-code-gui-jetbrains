import {ToolUseBlockDto} from "@/dto";
import {RendererProps, ToolHeader, ToolWrapper, toolResultText} from "../../common";
import {McpToolBody, McpToolRow, formatMcpToolName} from "../_common";
import {GmailMailRow, isUnread, safeParseJson} from "./_shared";

class GetThreadToolUseDto extends ToolUseBlockDto {
    declare input: {
        threadId?: string;
        messageFormat?: string;
    };
}

interface GmailMessage {
    date?: string;
    sender?: string;
    snippet?: string;
    subject?: string;
    labelIds?: string[];
}

interface GetThreadResult {
    messages?: GmailMessage[];
}

/**
 * Extract the message array from a get_thread result. The result may be a
 * thread object directly carrying `messages`, so we read that field
 * defensively without renaming any original key.
 */
function extractMessages(parsed?: GetThreadResult): GmailMessage[] | undefined {
    if (parsed && Array.isArray(parsed.messages)) return parsed.messages;
    return undefined;
}

export function GetThreadRenderer(props: RendererProps) {
    const {toolUse: rawToolUse, toolResult} = props;
    const toolUse = rawToolUse as GetThreadToolUseDto;
    const name = formatMcpToolName(toolUse.name);
    const threadId = toolUse.input?.threadId ?? '';

    const outputText = toolResultText(toolResult);
    const parsed = safeParseJson<GetThreadResult>(outputText);
    const messages = extractMessages(parsed);
    const subject = messages?.[0]?.subject;

    return (
        <ToolWrapper message={props.message} groupClassName="pb-2.5">
            <ToolHeader name={name}>
                <div className="truncate text-text-link text-[0.9230rem] font-mono">
                    {subject || threadId}
                </div>
            </ToolHeader>

            {messages ? (
                <McpToolBody>
                    {messages.map((msg, i) => (
                        <GmailMailRow
                            key={i}
                            sender={msg.sender}
                            subject={msg.subject}
                            date={msg.date}
                            snippet={msg.snippet}
                            unread={isUnread(msg.labelIds)}
                        />
                    ))}
                </McpToolBody>
            ) : (
                outputText && (
                    <McpToolBody>
                        <McpToolRow label="OUT">{outputText}</McpToolRow>
                    </McpToolBody>
                )
            )}
        </ToolWrapper>
    );
}
