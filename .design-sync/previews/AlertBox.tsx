import { AlertBox } from 'manifund'

export const Warning = () => (
  <div className="w-[28rem]">
    <AlertBox title="This project is still a draft" type="warning">
      Only you can see it. Publish it to start receiving offers.
    </AlertBox>
  </div>
)

export const ErrorState = () => (
  <div className="w-[28rem]">
    <AlertBox title="Your payment didn't go through" type="error">
      The card was declined. Try another card or contact your bank.
    </AlertBox>
  </div>
)

export const Info = () => (
  <div className="w-[28rem]">
    <AlertBox title="Funding closes on March 31" type="info">
      Offers made after the deadline won't count toward the minimum.
    </AlertBox>
  </div>
)

export const Success = () => (
  <div className="w-[28rem]">
    <AlertBox title="Donation received" type="success">
      $2,500 was sent to Open benchmarks for sparse autoencoder evaluation.
    </AlertBox>
  </div>
)

export const TitleOnly = () => (
  <div className="w-[28rem]">
    <AlertBox title="You have $12,000 left to regrant this year" type="info" />
  </div>
)
