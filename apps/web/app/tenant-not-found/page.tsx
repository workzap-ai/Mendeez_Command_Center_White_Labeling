export default function TenantNotFoundPage() {
  return (
    <main className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-lg font-semibold">No workspace here</h1>
      <p className="mt-2 text-sm text-gray-500">
        This address isn&apos;t connected to a workspace on this platform. Check the link, or
        contact whoever invited you.
      </p>
    </main>
  );
}
