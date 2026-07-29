export default function Timeline({ events }: { events: any[] }) {
  return (
    <div className="space-y-4">
      {events.map((event, index) => (
        <div key={index} className="flex items-start space-x-3">
          <div className="w-3 h-3 bg-blue-500 rounded-full mt-1"></div>
          <div>
            <p className="font-medium">{event.event_name}</p>
            <p className="text-sm text-gray-500">
              {new Date(event.event_timestamp).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
