import { Modal, Button } from 'manifund'

export const Confirm = () => (
  <Modal open setOpen={() => {}}>
    <h3 className="text-lg font-semibold text-gray-900">Withdraw your offer?</h3>
    <p className="mt-2 text-sm text-gray-500">
      Your $2,500 offer to "Open benchmarks for sparse autoencoder evaluation" will be cancelled and
      the funds returned to your balance.
    </p>
    <div className="mt-5 flex justify-end gap-3">
      <Button color="gray">Keep offer</Button>
      <Button color="rose">Withdraw</Button>
    </div>
  </Modal>
)
