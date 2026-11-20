import { redirect, type LoaderFunctionArgs } from "react-router";

/** Old address: Support (tickets) is a section of Settings now (?ticket= is kept). */
export const loader = ({ request, params }: LoaderFunctionArgs) => {
  const hash = /^[a-z0-9]{1,32}$/i.test(params.storeHash ?? "") ? params.storeHash : "";
  const ticket = new URL(request.url).searchParams.get("ticket");
  const query = ticket ? `?ticket=${encodeURIComponent(ticket)}` : "";
  return redirect(`${hash ? `/store/${hash}` : ""}/app/settings${query}#support`);
};
