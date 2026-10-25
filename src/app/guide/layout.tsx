import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BitLab — Guide',
  description:
    'Documentation BitLab : clés et adresses, transactions, multi-réseaux, Lightning LDK réel et API du laboratoire.',
};

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return children;
}
