import type { ChangeEvent } from 'react';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button';
import { FrameBracket } from './FrameBracket';
import { Input } from './Input';
import { ProgressBar } from './ProgressBar';
import { ScannerSweep } from './ScannerSweep';

describe('shared UI primitives', () => {
  it('renders four frame bracket corners around children', () => {
    render(
      <FrameBracket size={20} color="primary">
        <span>payload</span>
      </FrameBracket>,
    );

    expect(screen.getByText('payload')).toBeInTheDocument();
    expect(screen.getAllByTestId('frame-bracket-corner')).toHaveLength(4);
  });

  it('applies different classes for primary and secondary buttons', () => {
    render(
      <>
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
      </>,
    );

    expect(screen.getByRole('button', { name: 'Primary' })).toHaveClass('bg-primary', 'text-bg-primary');
    expect(screen.getByRole('button', { name: 'Secondary' })).toHaveClass('border-primary', 'text-primary');
  });

  it('does not fire disabled button click handlers', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <Button variant="primary" disabled onClick={onClick}>
        Disabled
      </Button>,
    );

    await user.click(screen.getByRole('button', { name: 'Disabled' }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it('propagates input change events', async () => {
    const user = userEvent.setup();
    const values: string[] = [];
    const onChange = vi.fn((event: ChangeEvent<HTMLInputElement>) => {
      values.push(event.currentTarget.value);
    });

    render(<InputHarness onChange={onChange} />);

    const input = screen.getByRole('textbox', { name: 'Game ID' });

    await user.type(input, 'pilot-7');

    expect(onChange).toHaveBeenCalled();
    expect(values.at(-1)).toBe('pilot-7');
    expect(input).toHaveValue('pilot-7');
  });

  it('shows the correct number of filled progress segments', () => {
    const { container } = render(<ProgressBar progress={0.35} />);

    expect(screen.getAllByTestId('progress-segment')).toHaveLength(10);
    expect(container.querySelectorAll('[data-filled="true"]')).toHaveLength(4);
  });

  it('marks progress bar as indeterminate when requested', () => {
    const { container } = render(<ProgressBar indeterminate />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Loading');
    expect(container.querySelectorAll('[data-animated="true"]')).toHaveLength(10);
  });

  it('renders scanner sweep overlay', () => {
    render(<ScannerSweep />);

    expect(screen.getByTestId('scanner-sweep')).toBeInTheDocument();
  });
});

function InputHarness({ onChange }: { onChange: (event: ChangeEvent<HTMLInputElement>) => void }) {
  const [value, setValue] = useState('');

  return (
    <Input
      aria-label="Game ID"
      id="game-id"
      placeholder="Enter Game ID"
      value={value}
      onChange={(event) => {
        setValue(event.currentTarget.value);
        onChange(event);
      }}
    />
  );
}
