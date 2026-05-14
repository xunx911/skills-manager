#!/usr/bin/env ruby
# frozen_string_literal: true

require "socket"
require "English"

port = Integer(ARGV.fetch(0))
app = ARGV.fetch(1, "skillhub.api.main:app")
host = ENV.fetch("SKILLHUB_SOCKET_HOST", "127.0.0.1")

server = TCPServer.new(host, port)
pid = spawn(
  { "UV_NO_CACHE" => ENV.fetch("UV_NO_CACHE", "1") },
  "uv",
  "run",
  "uvicorn",
  app,
  "--fd",
  "3",
  3 => server,
)
server.close

["INT", "TERM"].each do |signal|
  Signal.trap(signal) do
    Process.kill(signal, pid) rescue nil
  end
end

Process.wait(pid)
exit($CHILD_STATUS.exitstatus || 0)
