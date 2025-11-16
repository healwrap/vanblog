export default function (props: {
  children: any;
  sideBar: any;
}) {
  return (
    <>
      <div className="flex justify-center gap-6 w-full">
        <div className="flex-1 w-full md:max-w-4xl xl:max-w-4xl 2xl:max-w-4xl vanblog-main">
          {props.children}
        </div>
        <div
          className={`hidden lg:block flex-shrink-0 flex-grow-0 vanblog-sider ${
            Boolean(props.sideBar) ? "w-52" : ""
          }`}
        >
          {props.sideBar}
        </div>
      </div>
    </>
  );
}
