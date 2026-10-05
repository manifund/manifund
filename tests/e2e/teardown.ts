// Delete everything browser tests created: rows whose slug or text carries an "e2e-" run marker.
import { rest } from './support'

export default async function teardown() {
  const projects = await rest(`projects?slug=like.e2e-*&select=id`)
  for (const { id } of projects) {
    await rest(`comments?project=eq.${id}`, 'DELETE')
    await rest(`project_follows?project_id=eq.${id}`, 'DELETE')
    await rest(`projects?id=eq.${id}`, 'DELETE')
  }
  // Profile comments made by browser tests carry the marker in their text.
  await rest(`comments?profile_id=not.is.null&content->content->0->content->0->>text=like.*e2e-*`, 'DELETE')
}
