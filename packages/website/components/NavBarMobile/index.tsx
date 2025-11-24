import { slide as Menu } from "react-burger-menu";
import Link from "next/link";
import { useCallback, useContext, useMemo } from "react";
import type { MenuItem } from "../../api/getAllData";
import { getMenuItemKey } from "../NavBar/menuKey";
import { ThemeContext } from "../../utils/themeContext";

export default function (props: {
  isOpen: boolean;
  setIsOpen: (i: boolean) => void;
  showFriends: "true" | "false";
  showAdminButton: "true" | "false";
  menus: MenuItem[];
  siteName: string;
  logo: string;
  logoDark?: string;
}) {
  const { theme } = useContext(ThemeContext);

  const picUrl = useMemo(() => {
    if (theme.includes("dark") && props.logoDark && props.logoDark !== "") {
      return props.logoDark;
    }
    return props.logo;
  }, [theme, props]);

  const closeMenu = useCallback(() => {
    document.body.style.overflow = "auto";
    props.setIsOpen(false);
  }, [props.setIsOpen]);

  const renderItem = useCallback(
    (item: MenuItem, options?: { isSub?: boolean; suffix?: string }) => {
      const isSub = options?.isSub;
      const key = getMenuItemKey(item, options?.suffix);
      const content = (
        <div
          className={`w-full flex items-center py-3 ${
            isSub ? "pl-8 pr-4" : "px-4"
          } rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-200 group active:scale-95`}
        >
          <span className="text-base font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {item.name}
          </span>
        </div>
      );

      if (item.value.includes("http")) {
        return (
          <li key={key} className="mb-1 list-none">
            <a
              className="block w-full"
              target="_blank"
              href={item.value}
              onClick={closeMenu}
            >
              {content}
            </a>
          </li>
        );
      } else {
        return (
          <li key={key} className="mb-1 list-none">
            <Link href={item.value} className="block w-full" onClick={closeMenu}>
              {content}
            </Link>
          </li>
        );
      }
    },
    [closeMenu]
  );

  const renderLinks = useCallback(() => {
    const arr: JSX.Element[] = [];
    props.menus.forEach((item, parentIdx) => {
      arr.push(renderItem(item, { suffix: `root-${parentIdx}` }));
      if (item.children && item.children.length > 0) {
        item.children.forEach((i, childIdx) => {
          arr.push(
            renderItem(i, {
              isSub: true,
              suffix: `child-${parentIdx}-${childIdx}`,
            })
          );
        });
      }
    });
    return arr;
  }, [props.menus, renderItem]);

  return (
    <Menu
      id="nav-mobile"
      disableAutoFocus={true}
      customCrossIcon={false}
      customBurgerIcon={false}
      isOpen={props.isOpen}
      onStateChange={(state) => {
        if (state.isOpen) {
          document.body.style.overflow = "hidden";
        } else {
          document.body.style.overflow = "auto";
        }
        props.setIsOpen(state.isOpen);
      }}
      className="mobile-menu"
    >
      <div className="flex flex-col h-full bg-white dark:bg-[#1d2025] text-left outline-none">
        {/* Header */}
        <div className="px-6 pt-8 pb-6 mb-2 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center space-x-3">
            {picUrl && (
              <img
                src={picUrl}
                alt="Logo"
                className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-700"
              />
            )}
            <span className="text-lg font-bold text-gray-900 dark:text-white tracking-tight line-clamp-1">
              {props.siteName}
            </span>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-none">
          <ul className="w-full p-0 m-0">{renderLinks()}</ul>
        </nav>

        {/* Footer / Admin Button */}
        {props.showAdminButton === "true" && (
          <div className="p-4 mt-auto border-t border-gray-100 dark:border-gray-800">
            <a
              className="flex items-center justify-center w-full py-3 px-4 rounded-lg bg-gray-50 dark:bg-[#26282c] text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all active:scale-95"
              target="_blank"
              rel="noreferrer"
              href={"/admin"}
              onClick={closeMenu}
            >
              <svg
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              后台管理
            </a>
          </div>
        )}
      </div>
    </Menu>
  );
}
