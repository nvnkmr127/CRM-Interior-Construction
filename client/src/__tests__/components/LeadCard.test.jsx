/* eslint-disable no-unused-vars, no-undef */
import React from 'react';
import { render, screen } from '@testing-library/react';
import LeadCard from '../../components/leads/LeadCard';

describe('LeadCard', () => {
  it('renders lead name and details correctly', () => {
    const mockLead = {
      id: '1',
      name: 'John Doe',
      phone: '+1234567890',
      status: 'new',
      created_at: new Date().toISOString(),
      score: 85
    };

    render(<LeadCard lead={mockLead} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('+1234567890')).toBeInTheDocument();
  });
});
