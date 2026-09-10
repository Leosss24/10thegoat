export type ConsentData = {
  listenerId?: number;
  gdprApplies?: boolean;
  eventStatus?: string;
  cmpStatus?: string;
  purpose?: { consents?: Record<number, boolean> };
  vendor?: { consents?: Record<number, boolean> };
};

// Unknown, failed and open consent dialogs never enable our ad requests.
// Google remains responsible for evaluating the complete TCF/GPP signals.
export function mayRequestAds(data: ConsentData | undefined, success: boolean): boolean {
  if (!success || !data || data.cmpStatus !== "loaded") return false;
  if (data.eventStatus !== "tcloaded" && data.eventStatus !== "useractioncomplete") return false;
  if (data.gdprApplies === false) return true;
  return data.gdprApplies === true && data.purpose?.consents?.[1] === true
    && data.vendor?.consents?.[755] === true;
}
