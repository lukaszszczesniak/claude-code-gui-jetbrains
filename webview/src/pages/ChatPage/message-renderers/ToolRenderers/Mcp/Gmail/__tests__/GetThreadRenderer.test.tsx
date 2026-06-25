import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {GetThreadRenderer} from '../GetThreadRenderer';
import {makeToolUse, makeToolResult} from './helpers';

const TOOL = 'mcp__claude_ai_Gmail__get_thread';

const SAMPLE = JSON.stringify({
    messages: [
        {
            sender: 'alice@example.com',
            subject: 'Project kickoff',
            date: '2026-06-08T16:01:01Z',
            snippet: 'Let us start the project',
            labelIds: ['INBOX'],
        },
        {
            sender: 'bob@example.com',
            subject: 'Re: Project kickoff',
            date: '2026-06-09T09:00:00Z',
            snippet: 'Sounds good to me',
            labelIds: ['UNREAD', 'INBOX'],
        },
    ],
});

describe('GetThreadRenderer', () => {
    it('renders the formatted tool name in the header', () => {
        render(<GetThreadRenderer toolUse={makeToolUse({threadId: 't1'}, TOOL)} />);
        expect(screen.getByText('Claude AI Gmail [get_thread]')).toBeInTheDocument();
    });

    it('renders each message sender', () => {
        render(
            <GetThreadRenderer
                toolUse={makeToolUse({threadId: 't1'}, TOOL)}
                toolResult={makeToolResult(SAMPLE)}
            />
        );
        expect(screen.getByText('alice@example.com')).toBeInTheDocument();
        expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    });

    it('renders message snippets', () => {
        render(
            <GetThreadRenderer
                toolUse={makeToolUse({threadId: 't1'}, TOOL)}
                toolResult={makeToolResult(SAMPLE)}
            />
        );
        expect(screen.getByText(/Let us start the project/)).toBeInTheDocument();
    });

    it('falls back to raw OUT when result is not valid JSON', () => {
        render(
            <GetThreadRenderer
                toolUse={makeToolUse({threadId: 't1'}, TOOL)}
                toolResult={makeToolResult('garbage')}
            />
        );
        expect(screen.getByText('OUT')).toBeInTheDocument();
        expect(screen.getByText(/garbage/)).toBeInTheDocument();
    });

    it('does not throw when input is missing', () => {
        expect(() => render(<GetThreadRenderer toolUse={makeToolUse({}, TOOL)} />)).not.toThrow();
    });
});
