import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/morning')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/morning"!</div>
}
