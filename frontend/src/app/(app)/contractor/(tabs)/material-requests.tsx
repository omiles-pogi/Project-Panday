import RequestList from "@/screens/materialRequests/RequestList";
import { useCallback } from "react";
import { router, useLocalSearchParams } from "expo-router";

export default function ContractorMaterialRequests() {
  const { create } = useLocalSearchParams<{ create?: string }>();
  const handled = useCallback(() => router.setParams({ create: undefined }), []);
  return <RequestList viewer="contractor" topInset={false} extraBottomPadding={0} createRequested={create === "1"}
    onCreateHandled={handled} detailPath={(id) => `/contractor/material-request/${id}`} />;
}
