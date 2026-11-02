// Stand-ins painted in CSS for homepage art that has not been generated yet.
// Each keeps the light and the quiet areas of its brief, so text placement
// and contrast are already right before the real painting arrives.

export function DawnBackdrop() {
  return (
    <div className="absolute inset-0 bg-[linear-gradient(180deg,#0b1c22_0%,#16323a_34%,#5a6450_60%,#c5975a_71%,#2a3a33_84%,#111b1e_100%)]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_38%_30%_at_72%_68%,#f6d58fb0,transparent_70%)]" />
      <div className="absolute inset-x-0 bottom-[14%] h-[40%] bg-[#3d5c58]/75 [clip-path:polygon(0_62%,9%_44%,19%_56%,31%_30%,43%_50%,52%_38%,61%_58%,70%_47%,82%_60%,92%_41%,100%_52%,100%_100%,0_100%)]" />
      <div className="absolute inset-x-0 bottom-[6%] h-[30%] bg-[#1f3633] [clip-path:polygon(0_46%,14%_60%,27%_40%,41%_66%,55%_48%,68%_70%,81%_50%,100%_64%,100%_100%,0_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[18%] bg-[#0e1a1b] [clip-path:polygon(0_40%,22%_62%,44%_45%,63%_70%,78%_30%,90%_8%,100%_20%,100%_100%,0_100%)]" />
    </div>
  );
}

export function MarketBackdrop() {
  return (
    <div className="absolute inset-0 bg-[linear-gradient(180deg,#14262b_0%,#2b3a36_40%,#4a3d2a_68%,#1a2326_100%)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_58%_52%,#f0b8664d,transparent_16%),radial-gradient(circle_at_72%_44%,#f0b86640,transparent_12%),radial-gradient(circle_at_86%_58%,#f0b86638,transparent_14%),radial-gradient(circle_at_66%_70%,#e0874a2e,transparent_22%)]" />
    </div>
  );
}

export function DungeonBackdrop() {
  return (
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_60%_40%,#2b2340_0%,#16141f_55%,#0c1114_100%)]">
      <div className="absolute left-[44%] top-[16%] h-[62%] w-[30%] rounded-t-full bg-[radial-gradient(ellipse_60%_55%_at_50%_80%,#e0874a66,#3a1e1a_55%,#07090b_80%)] shadow-[0_0_120px_40px_#0c0f13]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_46%,#f0a35a40,transparent_5%),radial-gradient(circle_at_80%_46%,#f0a35a40,transparent_5%)]" />
    </div>
  );
}

export function NightBackdrop() {
  return (
    <div className="absolute inset-0 bg-[linear-gradient(180deg,#070e17_0%,#0d1b2a_45%,#122431_70%,#0b1418_100%)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_12%,#eee5d2cc_0_1px,transparent_2px),radial-gradient(circle_at_17%_31%,#eee5d299_0_1px,transparent_2px),radial-gradient(circle_at_26%_8%,#eee5d2_0_1.2px,transparent_2.2px),radial-gradient(circle_at_38%_22%,#eee5d288_0_1px,transparent_2px),radial-gradient(circle_at_47%_6%,#eee5d2bb_0_1px,transparent_2px),radial-gradient(circle_at_55%_28%,#eee5d277_0_1px,transparent_2px),radial-gradient(circle_at_63%_14%,#eee5d2_0_1.4px,transparent_2.4px),radial-gradient(circle_at_71%_35%,#eee5d288_0_1px,transparent_2px),radial-gradient(circle_at_79%_9%,#eee5d2aa_0_1px,transparent_2px),radial-gradient(circle_at_86%_24%,#eee5d2_0_1.2px,transparent_2.2px),radial-gradient(circle_at_93%_15%,#eee5d299_0_1px,transparent_2px),radial-gradient(circle_at_33%_40%,#eee5d266_0_1px,transparent_2px)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_68%,#f0a35a66,transparent_16%),radial-gradient(ellipse_30%_8%_at_45%_82%,#9fb8d022,transparent)]" />
      <div className="absolute inset-x-0 bottom-[18%] h-[26%] bg-[#0a141a] [clip-path:polygon(0_40%,18%_20%,34%_46%,52%_30%,70%_55%,86%_38%,100%_50%,100%_100%,0_100%)]" />
    </div>
  );
}

export function AtlasBackdrop() {
  return (
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_68%_62%,#3a2e1f_0%,#16191a_55%,#0b1012_100%)]">
      <div className="absolute left-[44%] top-[36%] h-[46%] w-[46%] rotate-[-4deg] rounded-[10px] bg-[linear-gradient(90deg,#a98f62_0%,#cbb488_48%,#7d6845_50%,#d9c69c_52%,#e6d6b0_100%)] opacity-30 shadow-[0_40px_80px_#000]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_30%,#f5c77a55,transparent_14%)]" />
    </div>
  );
}
