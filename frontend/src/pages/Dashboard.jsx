import Navbar      from "../components/layout/Navbar";
import LeftSidebar from "../components/layout/LeftSidebar";
import RightPanel  from "../components/layout/RightPanel";
import IndiaMap    from "../components/map/IndiaMap";
import MapPopup    from "../components/map/MapPopup";
import CoordBar    from "../components/map/CoordBar";
import AIBar       from "../components/ai/AIBar";

export default function Dashboard() {
  return (
    <div className="relative w-full h-screen overflow-hidden bg-white">
      {/* India map background */}
      <IndiaMap />

      {/* Floating navbar */}
      <Navbar />

      {/* Left sidebar */}
      <LeftSidebar />

      {/* Right insights panel */}
      <RightPanel />

      {/* Click popup */}
      <MapPopup />

      {/* AI command bar */}
      <AIBar />

      {/* Coordinate readout */}
      <CoordBar />
    </div>
  );
}
