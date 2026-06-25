import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {ListLabelsRenderer} from '../ListLabelsRenderer';
import {makeToolUse, makeToolResult} from './helpers';

const TOOL = 'mcp__claude_ai_Gmail__list_labels';

const SAMPLE = JSON.stringify({
    labels: [
        {id: 'INBOX', name: 'INBOX', type: 'system'},
        {id: 'Label_1', name: 'Work', type: 'user'},
        {id: 'Label_2', name: 'Personal', type: 'user'},
    ],
});

describe('ListLabelsRenderer', () => {
    it('renders the formatted tool name in the header', () => {
        render(<ListLabelsRenderer toolUse={makeToolUse({}, TOOL)} />);
        expect(screen.getByText('Claude AI Gmail [list_labels]')).toBeInTheDocument();
    });

    it('renders each label name as a chip', () => {
        render(
            <ListLabelsRenderer
                toolUse={makeToolUse({}, TOOL)}
                toolResult={makeToolResult(SAMPLE)}
            />
        );
        expect(screen.getByText('INBOX')).toBeInTheDocument();
        expect(screen.getByText('Work')).toBeInTheDocument();
        expect(screen.getByText('Personal')).toBeInTheDocument();
    });

    it('falls back to raw OUT when result is not valid JSON', () => {
        render(
            <ListLabelsRenderer
                toolUse={makeToolUse({}, TOOL)}
                toolResult={makeToolResult('broken')}
            />
        );
        expect(screen.getByText('OUT')).toBeInTheDocument();
        expect(screen.getByText(/broken/)).toBeInTheDocument();
    });

    it('does not throw when input is missing', () => {
        expect(() => render(<ListLabelsRenderer toolUse={makeToolUse({}, TOOL)} />)).not.toThrow();
    });
});
