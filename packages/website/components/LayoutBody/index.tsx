export default function (props: {
  children: any;
  sideBar: any;
  sidePosition?: "left" | "right";
}) {
  return (
    <>
      <div className="flex justify-center w-full gap-4">
        {props.sidePosition === "left" && (
          <div
            className={`hidden lg:block flex-shrink-0 flex-grow-0 vanblog-sider ${
              Boolean(props.sideBar) ? "w-52" : ""
            }`}
          >
            {props.sideBar}
          </div>
        )}
        <div className={`flex-1 w-full vanblog-main ${Boolean(props.sideBar) ? 'lg:max-w-[calc(100%-13rem-1rem)]' : ''}`}>
          {props.children}
        </div>
        {(!props.sidePosition || props.sidePosition === "right") && (
          <div
            className={`hidden lg:block flex-shrink-0 flex-grow-0 vanblog-sider ${
              Boolean(props.sideBar) ? "w-52" : ""
            }`}
          >
            {props.sideBar}
          </div>
        )}
      </div>
    </>
  );
}
