import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {ListDraftsRenderer} from '../ListDraftsRenderer';
import {makeToolUse, makeToolResult} from './helpers';

const TOOL = 'mcp__claude_ai_Gmail__list_drafts';

const SAMPLE = JSON.stringify({
    drafts: [
        {id: 'd1', message: {subject: 'Draft one', snippet: 'First draft body', sender: 'me@example.com'}},
        {id: 'd2', message: {subject: 'Draft two', snippet: 'Second draft body', sender: 'me@example.com'}},
    ],
});

describe('ListDraftsRenderer', () => {
    it('renders the formatted tool name in the header', () => {
        render(<ListDraftsRenderer toolUse={makeToolUse({}, TOOL)} />);
        expect(screen.getByText('Claude AI Gmail [list_drafts]')).toBeInTheDocument();
    });

    it('renders draft subjects', () => {
        render(
            <ListDraftsRenderer
                toolUse={makeToolUse({}, TOOL)}
                toolResult={makeToolResult(SAMPLE)}
            />
        );
        expect(screen.getByText('Draft one')).toBeInTheDocument();
        expect(screen.getByText('Draft two')).toBeInTheDocument();
    });

    it('renders draft snippets', () => {
        render(
            <ListDraftsRenderer
                toolUse={makeToolUse({}, TOOL)}
                toolResult={makeToolResult(SAMPLE)}
            />
        );
        expect(screen.getByText(/First draft body/)).toBeInTheDocument();
    });

    it('falls back to raw OUT when result is not valid JSON', () => {
        render(
            <ListDraftsRenderer
                toolUse={makeToolUse({}, TOOL)}
                toolResult={makeToolResult('not-json')}
            />
        );
        expect(screen.getByText('OUT')).toBeInTheDocument();
        expect(screen.getByText(/not-json/)).toBeInTheDocument();
    });

    it('does not throw when input is missing', () => {
        expect(() => render(<ListDraftsRenderer toolUse={makeToolUse({}, TOOL)} />)).not.toThrow();
    });
});
