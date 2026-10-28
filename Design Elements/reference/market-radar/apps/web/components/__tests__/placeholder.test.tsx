import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Page from '../../app/page';

describe('Market Radar placeholder', () => {
  it('identifies the product with an accessible heading and everyone. wordmark', () => {
    render(<Page />);

    expect(screen.getByRole('heading', { level: 1, name: 'Market Radar' })).toBeVisible();
    expect(screen.getByRole('img', { name: 'everyone.' })).toHaveAttribute(
      'src',
      '/brand/everyone-logotype.svg',
    );
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Internal · everyone.');
  });
});
