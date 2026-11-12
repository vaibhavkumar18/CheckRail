import { Outlet, useLocation } from "react-router-dom";

import Navbar from "../Navbar";
import Footer from "../Footer";

const PublicLayout = () => {
  const { pathname } = useLocation();

  const isHomePage = pathname === "/";

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />

      <main className="flex-1">
        <Outlet />
      </main>

      {isHomePage && <Footer />}
    </div>
  );
};

export default PublicLayout;