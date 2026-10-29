import RequestList from "@/screens/materialRequests/RequestList";

export default function ContractorMaterialRequests() {
  return <RequestList viewer="contractor" topInset={false} detailPath={(id) => `/contractor/material-request/${id}`} />;
}
