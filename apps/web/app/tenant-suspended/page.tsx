export default function TenantSuspendedPage() {
  return (
    <main className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-lg font-semibold">This workspace is paused</h1>
      <p className="mt-2 text-sm text-gray-500">
        Billing needs attention before this workspace can be reopened. If you&apos;re the owner,
        check your subscription; otherwise contact them.
      </p>
    </main>
  );
}
