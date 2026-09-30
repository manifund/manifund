import { createAdminClient } from '@/db/edge'
import { CreateTxn } from '../create-txn'
import { Table } from '@/components/table-catalyst'
import { requireAdmin } from '@/lib/require-admin'

export default async function TransactionsPage() {
  await requireAdmin() // before any admin-client read: the layout's check alone doesn't stop the page
  const supabaseAdmin = createAdminClient()
  const { data: txns } = await supabaseAdmin
    .from('txns')
    .select('*, from:profiles!txns_from_id_fkey(username), to:profiles!txns_to_id_fkey(username)')
    .eq('token', 'USD')
    .order('created_at', { ascending: false })

  return (
    <>
      <h3 className="text-lg">Create transaction</h3>
      <CreateTxn />
      <Table>
        <thead>
          <tr>
            <th className="p-2">From</th>
            <th className="p-2">To</th>
            <th className="p-2">Amount</th>
            <th className="p-2">Token</th>
            <th className="p-2">Created at</th>
          </tr>
        </thead>
        <tbody>
          {(txns ?? []).map((txn) => (
            <tr key={txn.id}>
              <td>{txn.from?.username}</td>
              <td>{txn.to?.username}</td>
              <td>{txn.amount}</td>
              <td>{txn.token}</td>
              <td>{new Date(txn.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  )
}
