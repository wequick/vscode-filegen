require 'xcodeproj'
require 'json'

def find_or_create_group(group, name)
  sub_group = group.children.find { |child| 
    child.path == name && child.is_a?(Xcodeproj::Project::Object::PBXGroup)
  }
  if sub_group.nil?
    sub_group = group.new_group(name, name)
  end
  return sub_group
end

def add_file(xcodeproj_path, project, file_path)
  if xcodeproj_path.nil? || file_path.nil? then
    puts "Usage: ruby add_file.rb <xcodeproj_path> <file_path>"
    exit 1
  end

  # xcodeproj_path parent
  project_root = Pathname.new(xcodeproj_path).parent()
  file_relpath = Pathname.new(file_path).parent().relative_path_from(project_root)

  path_components = file_relpath.to_s.split("/")
  target_name = path_components[0]
  target = project.targets.find { |t| t.name == target_name }

  unless target
    puts "Error: Target '#{target_name}' not found"
    exit 1
  end

  # add group
  current_group = project.main_group
  path_components.each do |component|
    current_group = find_or_create_group(current_group, component)
  end

  # if is swift file, check buildSettings
  if file_path.end_with?(".swift") then
    configuration_changed = false
    target.build_configurations.each do |config|
      # if not config.build_settings["CLANG_ENABLE_MODULES"] then set to YES
      if config.build_settings["CLANG_ENABLE_MODULES"].nil? then
        config.build_settings["CLANG_ENABLE_MODULES"] = "YES"
        configuration_changed = true
      end
      if config.build_settings["SWIFT_VERSION"].nil? then
        config.build_settings["SWIFT_VERSION"] = "5.0"
        configuration_changed = true
      end
      if config.name == "Debug" and config.build_settings["SWIFT_OPTIMIZATION_LEVEL"].nil? then
        config.build_settings["SWIFT_OPTIMIZATION_LEVEL"] = "-Onone"
        configuration_changed = true
      end
    end
    if configuration_changed then
      puts "Adds default swift build configurations"
    end
  end

  puts "current_group: #{current_group.display_name}"

  file_name = Pathname.new(file_path).basename().to_s

  # add file if file_path is a file
  if File.file?(file_path) then
    existing_file = current_group.files.find { |f| f.path == file_name }
    if existing_file
      puts "Warning: File '#{file_name}' already exists in group '#{current_group.display_name}'"
      return
    end
    file_ref = current_group.new_file(file_name)
    target.add_file_references([file_ref])
  else
    # add group if file_path is a directory
    find_or_create_group(current_group, file_name)
  end

  project.save
  puts "Success: '#{file_name}' added to group '#{current_group.display_name}' in target '#{target.name}'"
end

def main
  argc = ARGV.length
  if argc < 2 then
    puts "Usage: ruby add_file.rb <xcodeproj_path> <file_path> [file_path] ..."
    exit 1
  end
  xcodeproj_path = ARGV[0]
  project = Xcodeproj::Project.open(xcodeproj_path)
  # add file for each file_path
  for i in 2..argc do
    add_file(xcodeproj_path, project, ARGV[i - 1])
  end
end

main

