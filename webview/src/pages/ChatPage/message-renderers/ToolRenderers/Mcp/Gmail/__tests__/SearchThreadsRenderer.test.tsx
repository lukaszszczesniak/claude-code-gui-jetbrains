import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {SearchThreadsRenderer} from '../SearchThreadsRenderer';
import {makeToolUse, makeToolResult} from './helpers';

const TOOL = 'mcp__claude_ai_Gmail__search_threads';

const SAMPLE = JSON.stringify({
    resultCountEstimate: '7',
    threads: [
        {
            id: '19ea7fa9de249cb5',
            messages: [
                {
                    date: '2026-06-08T16:01:01Z',
                    id: '19ea7fa9de249cb5',
                    labelIds: ['UNREAD', 'INBOX'],
                    sender: 'no-reply@docker.com',
                    snippet: 'Gordon is GA...',
                    subject: '[Docker Navigator]: latest',
                    toRecipients: ['yhkks1038@gmail.com'],
                },
            ],
        },
        {
            id: 'abc123',
            messages: [
                {
                    date: '2026-06-07T10:00:00Z',
                    id: 'abc123',
                    labelIds: ['INBOX'],
                    sender: 'team@github.com',
                    snippet: 'Your weekly digest',
                    subject: 'GitHub weekly',
                    toRecipients: ['yhkks1038@gmail.com'],
                },
            ],
        },
    ],
});

describe('SearchThreadsRenderer', () => {
    it('renders the formatted tool name in the header', () => {
        render(<SearchThreadsRenderer toolUse={makeToolUse({query: 'from:docker'}, TOOL)} />);
        expect(screen.getByText('Claude AI Gmail [search_threads]')).toBeInTheDocument();
    });

    it('renders the query in the header', () => {
        render(<SearchThreadsRenderer toolUse={makeToolUse({query: 'from:docker'}, TOOL)} />);
        expect(screen.getByText(/from:docker/)).toBeInTheDocument();
    });

    it('renders the result count estimate', () => {
        render(
            <SearchThreadsRenderer
                toolUse={makeToolUse({query: 'from:docker'}, TOOL)}
                toolResult={makeToolResult(SAMPLE)}
            />
        );
        expect(screen.getByText(/7 found/)).toBeInTheDocument();
    });

    it('renders sender and subject of each thread first message', () => {
        render(
            <SearchThreadsRenderer
                toolUse={makeToolUse({query: 'x'}, TOOL)}
                toolResult={makeToolResult(SAMPLE)}
            />
        );
        expect(screen.getByText('no-reply@docker.com')).toBeInTheDocument();
        expect(screen.getByText('[Docker Navigator]: latest')).toBeInTheDocument();
        expect(screen.getByText('team@github.com')).toBeInTheDocument();
        expect(screen.getByText('GitHub weekly')).toBeInTheDocument();
    });

    it('renders the snippet', () => {
        render(
            <SearchThreadsRenderer
                toolUse={makeToolUse({query: 'x'}, TOOL)}
                toolResult={makeToolResult(SAMPLE)}
            />
        );
        expect(screen.getByText(/Gordon is GA/)).toBeInTheDocument();
    });

    it('falls back to raw OUT when result is not valid JSON', () => {
        render(
            <SearchThreadsRenderer
                toolUse={makeToolUse({query: 'x'}, TOOL)}
                toolResult={makeToolResult('not json at all')}
            />
        );
        expect(screen.getByText('OUT')).toBeInTheDocument();
        expect(screen.getByText(/not json at all/)).toBeInTheDocument();
    });

    it('does not throw when input is missing', () => {
        expect(() =>
            render(<SearchThreadsRenderer toolUse={makeToolUse({}, TOOL)} />)
        ).not.toThrow();
    });
});
