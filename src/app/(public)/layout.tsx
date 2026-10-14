import { MotionExperience } from "@/components/public/motion-experience";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicNavbar } from "@/components/public/public-navbar";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <MotionExperience>
      <div className="public-site">
        <PublicNavbar />
        <main>{children}</main>
        <PublicFooter />
      </div>
    </MotionExperience>
  );
}
