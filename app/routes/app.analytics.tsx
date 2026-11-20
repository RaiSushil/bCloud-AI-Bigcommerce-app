import { redirect, type LoaderFunctionArgs } from "react-router";

/** Old address: Analytics is now the app's first page (the filters in the query are kept). */
export const loader = ({ request, params }: LoaderFunctionArgs) => {
  const hash = /^[a-z0-9]{1,32}$/i.test(params.storeHash ?? "") ? params.storeHash : "";
  return redirect(`${hash ? `/store/${hash}` : ""}/app${new URL(request.url).search}`);
};
