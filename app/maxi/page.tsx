import { Avatar } from '@/components/avatar'
import { listProjects } from '@/db/project'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { karmaHotScore } from '@/utils/sort'
import { sortBy } from 'es-toolkit'

export default async function Maxifund() {
  const supabase = await createServerSupabaseClient()
  const [projects] = await Promise.all([listProjects(supabase)])
  const projectsToShow = sortBy(projects, [karmaHotScore]).slice(0, 18)

  return (
    <div>
      <div className="overflow-x-hidden bg-gradient-to-r from-orange-500 to-rose-400">
        <h1 className="whitespace-nowrap py-12 text-8xl text-white hover:animate-marquee">
          {/* Repeat the word MAXIFUND 10 times */}
          {Array.from({ length: 30 }, (_, i) => (
            <span key={i}>MAXIFUND </span>
          ))}
        </h1>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3">
        {projectsToShow.map((project) => (
          <div
            className="group relative bg-black transition hover:z-10 hover:scale-[2]"
            key={project.id}
          >
            <a href={`/projects/${project.slug}`}>
              <img
                className="aspect-square w-full object-cover"
                alt={project.title}
                src={`https://picsum.photos/seed/${project.id}/400/400`}
              />
              <div className="pointer-events-none absolute inset-0 flex items-end">
                <span className="h-24 w-full bg-gradient-to-t from-black to-transparent opacity-50" />
                <div className="absolute inset-0 flex items-center px-2">
                  <p className="text-center font-bold uppercase text-white drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)] sm:text-xl">
                    {project.title}
                  </p>
                </div>
              </div>
            </a>
            {/* Show the creator avatar on the bottom right */}
            <Avatar
              username={project.profiles.username}
              avatarUrl={project.profiles.avatar_url}
              id={project.profiles.id}
              size="sm"
              className="absolute right-2 top-2"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
