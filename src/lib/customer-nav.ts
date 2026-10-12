import { useEffect, useState } from "react";

const KEY = "admin_show_customer_nav";
const EVT = "customer-nav-change";

/** Admin-only preference (per device): show the shopper sections in the menus. Hidden by default. */
export function useCustomerNav(): [boolean, (v: boolean) => void] {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const read = () => setShow(localStorage.getItem(KEY) === "1");
    read();
    window.addEventListener(EVT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(EVT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  const set = (v: boolean) => {
    localStorage.setItem(KEY, v ? "1" : "0");
    window.dispatchEvent(new Event(EVT));
  };
  return [show, set];
}
