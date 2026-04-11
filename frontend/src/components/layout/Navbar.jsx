import useStore from "../../store/useStore";

export default function Navbar() {
  const { page, setPage } = useStore();

  const handlePageClick = (newPage) => {
    setPage(newPage);
    // Trigger capsule animation by briefly adding animation class
    document.querySelector("[data-capsule]")?.classList.add("animate-pulse");
    setTimeout(() => {
      document.querySelector("[data-capsule]")?.classList.remove("animate-pulse");
    }, 500);
  };

  return (
    <>
      {/* Brand logo - top left */}
      <div
        className="absolute top-4 left-4 z-[200] flex items-center gap-2"
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: "#000000",
          fontFamily: "'Poppins', system-ui, sans-serif",
          cursor: "pointer",
          position: "relative",
        }}
        onClick={() => {
          setPage("dashboard");
          handlePageClick("dashboard");
        }}
      >
        <span
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, #14B8A6, #0F766E)",
            borderRadius: 6,
            opacity: 0.15,
            filter: "blur(8px)",
            transform: "scale(1.2)",
            zIndex: -1,
          }}
        />
        GitGood
      </div>

      <nav
        className="absolute top-4 left-1/2 z-[200] flex items-center gap-1.5"
        style={{
          transform:      "translateX(-50%)",
          background:     "#FFFFFF",
          border:         "1px solid rgba(20,184,166,0.2)",
          borderRadius:   8,
          height:         50,
          padding:        "0 12px",
          backdropFilter: "blur(12px)",
          minWidth:       "auto",
          boxShadow:      "0 2px 8px rgba(0,0,0,0.08)",
          display:        "flex",
        }}
      >
        {/* Home */}
        <button
          onClick={() => handlePageClick("dashboard")}
          data-capsule
          style={{
            padding:      "8px 16px",
            borderRadius: 6,
            border:       "none",
            cursor:       "pointer",
            background:   page === "dashboard" ? "#000000" : "transparent",
            color:        page === "dashboard" ? "#FFFFFF" : "#666666",
            fontSize:     13,
            fontWeight:   page === "dashboard" ? 600 : 400,
            transition:   "all 0.25s cubic-bezier(0.4,0,0.2,1)",
            whiteSpace:   "nowrap",
          }}
          onMouseEnter={(e) => {
            if (page !== "dashboard") {
              e.target.style.background = "#F0F0F0";
              e.target.style.color = "#000000";
            }
          }}
          onMouseLeave={(e) => {
            if (page !== "dashboard") {
              e.target.style.background = "transparent";
              e.target.style.color = "#666666";
            }
          }}
        >
          Home
        </button>

        <div className="flex-1" />

        {/* Nav links */}
        {[
          { label: "Compare",  page: "compare"  },
          { label: "Reports",  page: "report"   },
          { label: "Settings", page: "settings" },
        ].map(({ label, page: linkPage }) => (
          <button
            key={linkPage}
            onClick={() => handlePageClick(linkPage)}
            style={{
              padding:      "8px 16px",
              borderRadius: 6,
              border:       "none",
              cursor:       "pointer",
              background:   page === linkPage ? "#000000" : "transparent",
              color:        page === linkPage ? "#FFFFFF" : "#666666",
              fontSize:     13,
              fontWeight:   page === linkPage ? 600 : 400,
              transition:   "all 0.25s cubic-bezier(0.4,0,0.2,1)",
            }}
            onMouseEnter={(e) => {
              if (page !== linkPage) {
                e.target.style.background = "#F0F0F0";
                e.target.style.color = "#000000";
              }
            }}
            onMouseLeave={(e) => {
              if (page !== linkPage) {
                e.target.style.background = "transparent";
                e.target.style.color = "#666666";
              }
            }}
          >
            {label}
          </button>
        ))}
      </nav>
    </>
  );
}
// }
//                   }}
//                 >
//                   {uc}
//                 </button>
//               ))}
//               <button
//                 onClick={() => {
//                   setUseCase("Other");
//                   setUseCaseDropdown(false);
//                 }}
//                 style={{
//                   width: "100%",
//                   padding: "10px 14px",
//                   background: useCase === "Other" ? "#F0F0F0" : "#FFFFFF",
//                   border: "none",
//                   color: useCase === "Other" ? "#14B8A6" : "#666666",
//                   fontSize: 13,
//                   cursor: "pointer",
//                   textAlign: "left",
//                   fontWeight: useCase === "Other" ? 600 : 400,
//                   transition: "all 0.15s",
//                   borderRadius: "0 0 6px 6px",
//                 }}
//                 onMouseEnter={(e) => (e.target.style.background = "#F5F5F5")}
//                 onMouseLeave={(e) => {
//                   e.target.style.background = useCase === "Other" ? "#F0F0F0" : "#FFFFFF";
//                 }}
//               >
//                 Other
//               </button>
//             </div>
//           )}
//         </div>

//         <div className="flex-1" />

//         {/* Nav links */}
//         {[
//           { label: "Compare",  page: "compare"  },
//           { label: "Reports",  page: "report"   },
//           { label: "Settings", page: "settings" },
//         ].map(({ label, page: linkPage }) => (
//           <button
//             key={linkPage}
//             onClick={() => handlePageClick(linkPage)}
//             style={{
//               padding:      "8px 16px",
//               borderRadius: 6,
//               border:       "none",
//               cursor:       "pointer",
//               background:   page === linkPage ? "#000000" : "transparent",
//               color:        page === linkPage ? "#FFFFFF" : "#666666",
//               fontSize:     13,
//               fontWeight:   page === linkPage ? 600 : 400,
//               transition:   "all 0.25s cubic-bezier(0.4,0,0.2,1)",
//             }}
//             onMouseEnter={(e) => {
//               if (page !== linkPage) {
//                 e.target.style.background = "#F0F0F0";
//                 e.target.style.color = "#000000";
//               }
//             }}
//             onMouseLeave={(e) => {
//               if (page !== linkPage) {
//                 e.target.style.background = "transparent";
//                 e.target.style.color = "#666666";
//               }
//             }}
//           >
//             {label}
//           </button>
//         ))}

//         {/* Export */}
//         <button
//           style={{
//             padding:      "8px 16px",
//             borderRadius: 6,
//             cursor:       "pointer",
//             background:   "#F5F5F5",
//             border:       "1px solid #E5E5E5",
//             color:        "#000000",
//             fontSize:     13,
//             fontWeight:   600,
//             transition:   "all 0.15s",
//             whiteSpace:   "nowrap",
//           }}
//           onMouseEnter={(e) => (e.target.style.background = "#EEEEEE")}
//           onMouseLeave={(e) => (e.target.style.background = "#F5F5F5")}
//         >
//           Export
//         </button>
//       </nav>
//     </>
//   );
// }
