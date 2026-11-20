import { useEffect, useRef } from "react";
import { useFetcher } from "./router";
import type { MutationResult } from "../api/types";
import { useToast } from "../components/shell/ToastProvider";

/**
 * A fetcher for portal forms: shows a toast with the result and calls
 * onSuccess once per successful submit (e.g. to clear the form).
 */
export function useMutation(onSuccess?: () => void) {
  const fetcher = useFetcher<MutationResult>();
  const toast = useToast();
  const handled = useRef<unknown>(null);
  const successRef = useRef(onSuccess);
  useEffect(() => {
    successRef.current = onSuccess;
  });

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data || handled.current === fetcher.data) return;
    handled.current = fetcher.data;
    if (fetcher.data.ok) {
      if (fetcher.data.message) toast(fetcher.data.message);
      successRef.current?.();
    } else {
      toast(fetcher.data.error, "error");
    }
  }, [fetcher.state, fetcher.data, toast]);

  const error = fetcher.data && !fetcher.data.ok ? fetcher.data : null;
  return { fetcher, busy: fetcher.state !== "idle", error };
}
