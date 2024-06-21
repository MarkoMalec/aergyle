import React from "react";
import { prisma } from "~/lib/prisma";
import { authOptions } from "~/server/auth";
import { getServerSession } from "next-auth";

import { notFound } from 'next/navigation';

export async function generateStaticParams() {
  const skills = await prisma.skills.findMany();
  return skills.map(skill => ({
    name: skill.skill_name,
  }));
}


const SkillPage = async ({ params }: { params: { name: string } }) => {

    const skill = await prisma.skills.findUnique({
        where: { 
            skill_name: params.name
         }
    })
    
    if (!skill) {
        notFound();
      }


    return (
        <h1>
            {skill.skill_name}
            {skill.description}
        </h1>
    );
}

export default SkillPage;