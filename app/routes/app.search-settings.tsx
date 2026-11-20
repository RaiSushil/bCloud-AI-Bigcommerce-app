import { redirect, type LoaderFunctionArgs } from "react-router";

/** Old address: Search settings (synonyms) is a section of Settings now. */
export const loader = ({ params }: LoaderFunctionArgs) => {
  const hash = /^[a-z0-9]{1,32}$/i.test(params.storeHash ?? "") ? params.storeHash : "";
  return redirect(`${hash ? `/store/${hash}` : ""}/app/settings#synonyms`);
};
