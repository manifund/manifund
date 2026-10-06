import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from 'manifund'

const DONATIONS = [
  { project: 'Open benchmarks for SAE evaluation', donor: 'Neel Nanda', date: 'Mar 4, 2026', amount: '$12,000' },
  { project: 'Wastewater pathogen monitoring pilot', donor: 'Maria Hobbs', date: 'Feb 21, 2026', amount: '$6,500' },
  { project: 'Forecasting tournament for AI policy', donor: 'Tamay Besiroglu', date: 'Feb 9, 2026', amount: '$2,500' },
]

function Donations(props: { striped?: boolean; dense?: boolean; grid?: boolean }) {
  return (
    <div className="w-[40rem] px-2">
      <Table {...props}>
        <TableHead>
          <TableRow>
            <TableHeader>Project</TableHeader>
            <TableHeader>Donor</TableHeader>
            <TableHeader>Date</TableHeader>
            <TableHeader className="text-right">Amount</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {DONATIONS.map((d) => (
            <TableRow key={d.project}>
              <TableCell className="font-medium">{d.project}</TableCell>
              <TableCell>{d.donor}</TableCell>
              <TableCell className="text-zinc-500">{d.date}</TableCell>
              <TableCell className="text-right">{d.amount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export const Default = () => <Donations />
export const Striped = () => <Donations striped />
export const DenseGrid = () => <Donations dense grid />
