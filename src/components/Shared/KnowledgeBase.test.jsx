import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import KnowledgeBase from './KnowledgeBase';

const ARTICLES = [
  { id: 'kb_1', category: 'Scripts', title: 'Opening script', summary: 'How to open a call', content: 'Hello, this is ...', updatedAt: '2026-03-05T10:00:00.000Z' },
  { id: 'kb_2', category: 'Compliance', title: 'TCPA rules', summary: 'Calling hours', content: 'Never call before 8am', updatedAt: null }
];

const setup = (props = {}) => render(
  <KnowledgeBase
    articles={ARTICLES}
    canManage
    onCreateArticle={vi.fn().mockResolvedValue(undefined)}
    onUpdateArticle={vi.fn().mockResolvedValue(undefined)}
    onDeleteArticle={vi.fn().mockResolvedValue(undefined)}
    {...props}
  />
);

describe('KnowledgeBase', () => {
  it('an Admin/Supervisor sees an Add Document button; an Agent does not', () => {
    const { unmount } = setup();
    expect(screen.getByRole('button', { name: /add document/i })).toBeInTheDocument();
    unmount();
    setup({ canManage: false });
    expect(screen.queryByRole('button', { name: /add document/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^edit /i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^delete /i })).not.toBeInTheDocument();
  });

  it('publishes a new document with title, category, summary and text', async () => {
    const onCreateArticle = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    setup({ onCreateArticle });

    await user.click(screen.getByRole('button', { name: /add document/i }));
    await user.type(screen.getByLabelText(/title/i), 'Closing script');
    await user.type(screen.getByLabelText(/category/i), 'Scripts');
    await user.type(screen.getByLabelText(/document text/i), 'Ask for the sale.');
    await user.click(screen.getByRole('button', { name: /publish document/i }));

    await waitFor(() => expect(onCreateArticle).toHaveBeenCalledWith({ title: 'Closing script', category: 'Scripts', summary: '', content: 'Ask for the sale.' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /add document/i })).not.toBeInTheDocument());
  });

  it('will not publish without a title or without text', async () => {
    const onCreateArticle = vi.fn();
    const user = userEvent.setup();
    setup({ onCreateArticle });
    await user.click(screen.getByRole('button', { name: /add document/i }));

    await user.click(screen.getByRole('button', { name: /publish document/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/give the document a title/i);

    await user.type(screen.getByLabelText(/title/i), 'Only a title');
    await user.click(screen.getByRole('button', { name: /publish document/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/add the document text/i);
    expect(onCreateArticle).not.toHaveBeenCalled();
  });

  it('imports the text of a .txt file and names the document after the file', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /add document/i }));

    const file = new File(['Rebuttal one\nRebuttal two'], 'Objection Handling.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText(/import from a text file/i), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByLabelText(/document text/i).value).toBe('Rebuttal one\nRebuttal two'));
    expect(screen.getByLabelText(/title/i).value).toBe('Objection Handling');
  });

  it('does not overwrite a title that was already typed when importing a file', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /add document/i }));
    await user.type(screen.getByLabelText(/title/i), 'My own title');
    fireEvent.change(screen.getByLabelText(/import from a text file/i), { target: { files: [new File(['body'], 'other.txt')] } });
    await waitFor(() => expect(screen.getByLabelText(/document text/i).value).toBe('body'));
    expect(screen.getByLabelText(/title/i).value).toBe('My own title');
  });

  it('refuses an oversized import', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /add document/i }));
    const big = new File(['x'], 'big.txt');
    Object.defineProperty(big, 'size', { value: 1024 * 1024 });
    fireEvent.change(screen.getByLabelText(/import from a text file/i), { target: { files: [big] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/too large/i);
  });

  it('edits an existing document with the form pre-filled', async () => {
    const onUpdateArticle = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    setup({ onUpdateArticle });

    await user.click(screen.getByRole('button', { name: /edit opening script/i }));
    const title = screen.getByLabelText(/title/i);
    expect(title.value).toBe('Opening script');
    await user.clear(title);
    await user.type(title, 'Opening script v2');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(onUpdateArticle).toHaveBeenCalledWith('kb_1', expect.objectContaining({ title: 'Opening script v2', content: 'Hello, this is ...' })));
  });

  it('shows the server\'s reason if saving fails, and keeps the form open with the text intact', async () => {
    const onCreateArticle = vi.fn().mockRejectedValue(new Error('title is too long'));
    const user = userEvent.setup();
    setup({ onCreateArticle });
    await user.click(screen.getByRole('button', { name: /add document/i }));
    await user.type(screen.getByLabelText(/title/i), 'T');
    await user.type(screen.getByLabelText(/document text/i), 'Body');
    await user.click(screen.getByRole('button', { name: /publish document/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/title is too long/i);
    expect(screen.getByLabelText(/document text/i).value).toBe('Body');
  });

  it('deleting asks for confirmation first', async () => {
    const onDeleteArticle = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    setup({ onDeleteArticle });

    await user.click(screen.getByRole('button', { name: /delete tcpa rules/i }));
    expect(onDeleteArticle).not.toHaveBeenCalled();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(onDeleteArticle).toHaveBeenCalledWith('kb_2'));
  });

  it('cancelling the delete confirmation deletes nothing', async () => {
    const onDeleteArticle = vi.fn();
    const user = userEvent.setup();
    setup({ onDeleteArticle });
    await user.click(screen.getByRole('button', { name: /delete tcpa rules/i }));
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onDeleteArticle).not.toHaveBeenCalled();
  });

  it('shows the real updated date instead of a hard-coded claim', () => {
    setup();
    expect(screen.getByText(/updated 5 mar 2026/i)).toBeInTheDocument();
    expect(screen.queryByText(/q3 operations/i)).not.toBeInTheDocument();
  });

  it('renders document text as plain text, never as markup', () => {
    const { container } = setup({ articles: [{ id: 'x', category: 'A', title: '<b>bold</b>', summary: '', content: '<img src=x onerror=alert(1)>' }] });
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('pre').textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('search filters documents; empty states say what is going on', async () => {
    const user = userEvent.setup();
    const { rerender } = setup();
    await user.type(screen.getByLabelText(/search the knowledge base/i), 'tcpa');
    expect(screen.getByText('TCPA rules')).toBeInTheDocument();
    expect(screen.queryByText('Opening script')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/search the knowledge base/i), 'zzz');
    expect(screen.getByText(/no documents match/i)).toBeInTheDocument();

    rerender(<KnowledgeBase articles={[]} canManage />);
    expect(screen.getByText(/no documents yet/i)).toBeInTheDocument();
    expect(screen.getByText(/use “add document”/i)).toBeInTheDocument();
  });
});
