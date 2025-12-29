{msg.attachments && msg.attachments.length > 0 && (
  <div className="mt-2 border-l-4 border-blue-400 pl-3 text-sm">
    {msg.attachments.map((att) => (
      <div key={att.id} className="mt-1">
        <a
          href={att.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 underline hover:text-blue-200"
        >
          📎 {att.fileName}
        </a>
      </div>
    ))}
  </div>
)}
