require 'xcodeproj'
require 'json'

def find_group(group, name, create_if_not_exists)
  sub_group = group.children.find { |child| 
    child.path == name && child.is_a?(Xcodeproj::Project::Object::PBXGroup)
  }
  if create_if_not_exists && sub_group.nil?
    sub_group = group.new_group(name, name)
  end
  return sub_group
end

def remove_file(xcodeproj_path, project, file_path)
  if xcodeproj_path.nil? || file_path.nil? then
    puts "Usage: ruby remove_file.rb <xcodeproj_path> <file_path>"
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
    current_group = find_group(current_group, component, false)
    if current_group.nil? then
      puts "Warning: Group '#{component}' not exists in group '#{current_group.display_name}'"
      return
    end
  end
  puts "current_group: #{current_group.display_name}"

  file_pathname = Pathname.new(file_path)
  file_name = file_pathname.basename().to_s

  if File.file?(file_path) then
    # delete file if file_path is a file
    existing_file = current_group.files.find { |f| f.path == file_name }
    if existing_file.nil?
      puts "Warning: File '#{file_name}' not exists in group '#{current_group.display_name}'"
      return
    end
    existing_file.remove_from_project
  else
    # delete group if file_path is a directory
    current_group = find_group(current_group, file_name, false)
    if current_group.nil? then
      puts "Warning: Group '#{file_name}' not exists in group '#{current_group.display_name}'"
      return
    end
    current_group.remove_from_project
  end

  project.save
  puts "Success: '#{file_name}' removed from group '#{current_group.display_name}' in target '#{target.name}'"
end

def main
  argc = ARGV.length
  if argc < 2 then
    puts "Usage: ruby remove_file.rb <xcodeproj_path> <file_path> [file_path] ..."
    exit 1
  end
  xcodeproj_path = ARGV[0]
  project = Xcodeproj::Project.open(xcodeproj_path)
  # add file for each file_path
  for i in 2..argc do
    remove_file(xcodeproj_path, project, ARGV[i - 1])
  end
end

main

