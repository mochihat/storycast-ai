"use client";

import uniqid from "uniqid";
import React, { useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { FieldValues, SubmitHandler, useForm } from 'react-hook-form';
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";

import useUploadModal from '@/hooks/useUploadModal';
import { useUser } from "@/hooks/useUser";

import Modal from './Modal';
import Input from './Input';
import Button from './Button';

// the upload modal comp/ for uploading files(stories and images in form), using the supabase client
const UploadModal = () => {
  const [isLoading, setIsLoading] = useState(false);

  const uploadModal = useUploadModal();
  const supabaseClient = useSupabaseClient();
  const { user } = useUser();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
  } = useForm<FieldValues>({
    defaultValues: {
      author: '',
      title: '',
      story: null, // the stories and imgs are gon be files
      image: null,
    }
  });

  const onChange = (open: boolean) => {
    if (!open) {
      reset(); //the form will be reset with all the above default values
      uploadModal.onClose();
    }
  }

  // upload to supabase
  const onSubmit: SubmitHandler<FieldValues> = async (values) => {
    try {
      setIsLoading(true);
      // lets extract the data(story file and img file) from the form
      const imageFile = values.image?.[0];
      const storyFile = values.story?.[0];

      if (!imageFile || !storyFile || !user) {
        toast.error('Missing fields')
        return;
      }

      // unique id for the story and image to store in the database's bucket
      const uniqueID = uniqid();

      // Upload story
      const { 
        data: storyData, //remap/alias
        error: storyError 
      } = await supabaseClient
        .storage
        .from('stories') // from stories bucket.. and upload with the unique val.
        .upload(`story-${values.title}-${uniqueID}`, storyFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (storyError) {
        setIsLoading(false);
        return toast.error('Failed story upload');
      }

      // Upload image (as sim as the story)
      const { 
        data: imageData, 
        error: imageError
      } = await supabaseClient
        .storage
        .from('images')
        .upload(`image-${values.title}-${uniqueID}`, imageFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (imageError) {
        setIsLoading(false);
        return toast.error('Failed image upload');
      }

      
      // Create record (inser the table in the database by using the supabase client/ a sql query)
      const { error: supabaseError } = await supabaseClient
        .from('stories')
        .insert({
          user_id: user.id,
          title: values.title,
          author: values.author,
          image_path: imageData.path,
          story_path: storyData.path
        });

      if (supabaseError) {
        return toast.error(supabaseError.message);
      }
      
      router.refresh();
      setIsLoading(false);
      toast.success('Story created!');
      reset(); // reset the form
      uploadModal.onClose();
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Modal
      title="Add a story"
      description="Upload an mp3 file"
      isOpen={uploadModal.isOpen}
      onChange={onChange}
    >
      <form 
        onSubmit={handleSubmit(onSubmit)} 
        className="flex flex-col gap-y-4"
      >
        <Input
          id="title"
          disabled={isLoading}
          {...register('title', { required: true })} // register from the hook-form
          placeholder="Story title"
        />
        <Input
          id="author"
          disabled={isLoading}
          {...register('author', { required: true })} // the id and the 1st arg of register() ve to same
          placeholder="Story author"
        />
        <div>
          <div className="pb-1">
            Select a story file
          </div>
          {/* this i/p field only accepts .mp3 format */}
          <Input
            placeholder="test" 
            disabled={isLoading}
            type="file"
            accept=".mp3"
            id="story"
            {...register('story', { required: true })} 
          />
        </div>
        <div>
          <div className="pb-1">
            Select an image
          </div>
          <Input
            placeholder="test" 
            disabled={isLoading}
            type="file"
            accept="image/*"
            id="image"
            {...register('image', { required: true })}
          />
        </div>
        <Button disabled={isLoading} type="submit">
          Create
        </Button>
      </form>
    </Modal>
  );
}

export default UploadModal;
