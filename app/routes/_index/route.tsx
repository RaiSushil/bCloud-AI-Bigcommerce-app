import { messagePage } from "../../portal/bigcommerce/frame.server";

/** The app runs inside the BigCommerce control panel; its root only says so. */
export function loader() {
  return messagePage(
    "bCloud AI Search for BigCommerce",
    "Install the app from the BigCommerce App Marketplace, then open it from Apps in your BigCommerce control panel.",
    200,
  );
}
