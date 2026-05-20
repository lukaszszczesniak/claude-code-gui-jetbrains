import {useState} from "react";
import {ToolUseBlockDto} from "@/dto";
import {RendererProps, ToolHeader, ToolWrapper} from "./common";
import {MessageBubble} from "@/pages/ChatPage/MessageBubble.tsx";

class SkillToolUseDto extends ToolUseBlockDto {
    declare input: {
        skill: string;
        args?: string;
    };
}

export function SkillRenderer(props: RendererProps) {
    const toolUse = props.toolUse as unknown as SkillToolUseDto;
    const skillName = toolUse.input?.skill ?? 'Skill';
    const [expanded, setExpanded] = useState(false);
    const childMessages = toolUse.childMessages || [];

    return (
        <>
            <ToolWrapper message={props.message}>
                <ToolHeader name={skillName} inProgress={!props.toolResult}>
                    <button
                        type="button"
                        className="text-text-primary/60 hover:text-text-primary/80 cursor-pointer select-none hover:underline"
                        onClick={() => childMessages.length && setExpanded(v => !v)}
                    >
                        skill
                    </button>
                </ToolHeader>
            </ToolWrapper>

            {expanded && childMessages.map((msg, i) => (
                <MessageBubble key={msg.uuid ?? i} message={msg} />
            ))}
        </>
    );
}
