import RequestList from "@/screens/materialRequests/RequestList";

export default function HomeownerMaterialApprovals() {
  return <RequestList viewer="homeowner" topInset={false} detailPath={(id) => `/homeowner/approvals/${id}`} />;
}
