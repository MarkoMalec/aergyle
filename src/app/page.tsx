import Image from "next/image";

export default function HomePage() {
  return (
    <main className="bg-black w-full backdrop-blur-sm backdrop-filter">
      <div className="relative flex min-h-screen items-center justify-center">
      <div className="mb-20 text-center">
        <h3 className="text-lg text-white">Welcome to</h3>
        <h1 className="text-5xl font-extrabold text-white md:text-6xl lg:text-9xl">
          Aergyle
        </h1>
      </div>
      <Image
        className="object-auto absolute bottom-0 right-0 lg:w-[800px] xl:min-h-[75vh] xl:w-[1100px]"
        src="/assets/female-sword-hero.png"
        width="1251"
        height="868"
        alt="sword female"
      />
      {/* <div className="max-w-2xl px-4 text-center"> */}
      {/* <p className="font-small text-lg leading-relaxed text-white">
            Welcome to "Realm of Possibilities"! Dive into a digital playground
            teeming with colorful characters, brawny battles, and lighthearted
            lunacy! Sharpen your skills, hoard rare items, and hilariously whack
            your friends or lend them a helping hand. Nibble on the peaceful
            life, honing your vocation, be it farming, fishing, or the delicate
            art of woodcutting. Revel in the ever-evolving economy, a whirlpool
            of riches that only the wisest can master! Will you be a hero, a
            villain, or a cucumber farmer extraordinaire? Every epic tale needs
            a hero; how do you want your wild and whimsical journey to unfold?
            Let's roll!
          </p> */}
    </div>
    <section
      id="section1"
      className="container flex flex-wrap items-center justify-center gap-14 py-36 sm:flex-nowrap sm:gap-0"
    >
      <div className="flex-1 relative">
        <div className="sm:pl-14">
          <h2 className="text-5xl font-extrabold mb-7">Loot your way</h2>
          <p className="text-xl mb-14 max-w-[400px]">Embark into an adventure and don't forget to bring a weapon!</p>
        </div>
        <div className="sm:-mb-48 sm:ml-14 h-[450px] w-[100%] min-w-[330px] rounded-lg bg-white/10"></div>
      </div>
      <div className="relative flex-1">
        <div className="sm:-ml-14 h-[450px] w-[100%] min-w-[330px] rounded-lg bg-white/5"></div>
        <div className="absolute -bottom-36 sm:-right-28">
          <Image
            src="/assets/goblin.png"
            width={400}
            height={400}
            alt="knight"
          ></Image>
        </div>
      </div>
    </section>
    <>
      <div
        id="section-two"
        className="mt-36 h-[800px] bg-[url('/assets/section-bg.png')] bg-cover bg-fixed bg-center"
      >
        <div className="h-full backdrop-blur-[5px] backdrop-brightness-[.55]">
          <div className="container flex h-full items-center justify-center">
            <h2 className="text-2xl font-extrabold bg-gradient-to-l from-white via-white to-violet-900 bg-clip-text text-transparent">
            Welcome to "Realm of Possibilities"! Dive into a digital playground
            teeming with colorful characters, brawny battles, and lighthearted
            lunacy! Sharpen your skills, hoard rare items, and hilariously whack
            your friends or lend them a helping hand. Nibble on the peaceful
            life, honing your vocation, be it farming, fishing, or the delicate
            art of woodcutting. Revel in the ever-evolving economy, a whirlpool
            of riches that only the wisest can master! Will you be a hero, a
            villain, or a cucumber farmer extraordinaire? Every epic tale needs
            a hero; how do you want your wild and whimsical journey to unfold?
            Let's roll!</h2>
          </div>
        </div>
      </div>
      <div className="h-[1000px]"></div>
    </>
    </main>
  );
}
