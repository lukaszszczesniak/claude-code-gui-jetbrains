import {ToolUseBlockDto} from "@/dto";
import {RendererProps, ToolHeader, ToolWrapper, toolResultText} from "../../common";
import {McpToolBody, McpToolRow, formatMcpToolName} from "../_common";
import {GmailLabelChip, safeParseJson} from "./_shared";

class ListLabelsToolUseDto extends ToolUseBlockDto {
    declare input: {
        pageSize?: number;
        pageToken?: string;
    };
}

interface GmailLabel {
    id?: string;
    name?: string;
    type?: string;
}

interface ListLabelsResult {
    labels?: GmailLabel[];
}

export function ListLabelsRenderer(props: RendererProps) {
    const {toolUse: rawToolUse, toolResult} = props;
    const toolUse = rawToolUse as ListLabelsToolUseDto;
    const name = formatMcpToolName(toolUse.name);

    const outputText = toolResultText(toolResult);
    const parsed = safeParseJson<ListLabelsResult>(outputText);
    const labels = Array.isArray(parsed?.labels) ? parsed.labels : undefined;

    return (
        <ToolWrapper message={props.message} groupClassName="pb-2.5">
            <ToolHeader
                name={name}
                description={labels ? `${labels.length} label(s)` : ''}
            />

            {labels ? (
                <McpToolBody>
                    <div className="flex flex-wrap gap-1.5 p-2">
                        {labels.map((label, i) => (
                            <GmailLabelChip key={label.id ?? i}>
                                {label.name ?? label.id ?? '(unnamed)'}
                            </GmailLabelChip>
                        ))}
                    </div>
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
